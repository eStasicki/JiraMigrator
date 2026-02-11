use serde::Deserialize;
use base64::{engine::general_purpose, Engine as _};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProxyRequest {
    base_url: String,
    email: String,
    api_token: String,
    endpoint: String,
    method: Option<String>,
    body: Option<serde_json::Value>,
    is_tempo: Option<bool>,
    auth_type: Option<String>,
}

#[tauri::command]
async fn jira_proxy(req: ProxyRequest) -> Result<serde_json::Value, String> {
    let method = req.method.unwrap_or_else(|| "GET".to_string());
    let is_tempo = req.is_tempo.unwrap_or(false);
    
    let target_url = if is_tempo {
        let tempo_host = if req.base_url.contains(".atlassian.net") { "api.eu.tempo.io" } else { "api.tempo.io" };
        format!("https://{}{}", tempo_host, if req.endpoint.starts_with('/') { req.endpoint.clone() } else { format!("/{}", req.endpoint) })
    } else {
        if req.base_url.is_empty() {
            return Err("URL Jiry jest wymagany".to_string());
        }
        let normalized_url = if req.base_url.starts_with("http") {
            req.base_url.trim_end_matches('/').to_string()
        } else {
            format!("https://{}", req.base_url.trim_end_matches('/'))
        };
        let is_cloud = normalized_url.contains(".atlassian.net");
        let mut final_endpoint = req.endpoint.clone();
        if !is_cloud {
            final_endpoint = final_endpoint
                .replace("/rest/api/3/search/jql", "/rest/api/2/search")
                .replace("/rest/api/3/", "/rest/api/2/");
        }
        let base = format!("{}{}", normalized_url, if final_endpoint.starts_with('/') { final_endpoint } else { format!("/{}", final_endpoint) });
        let sep = if base.contains('?') { "&" } else { "?" };
        format!("{}os_authType=basic", if base.contains("os_authType") { base } else { format!("{}{}{}", base, sep, "os_authType=basic") })
    };

    let client = reqwest::Client::new();
    let mut request_builder = match method.to_uppercase().as_str() {
        "POST" => client.post(&target_url),
        "PUT" => client.put(&target_url),
        "DELETE" => client.delete(&target_url),
        _ => client.get(&target_url),
    };

    let auth_header = if is_tempo {
        format!("Bearer {}", req.api_token)
    } else {
        let token = req.api_token.trim();
        if token.starts_with("Basic ") || token.starts_with("Bearer ") {
            token.to_string()
        } else if req.auth_type.as_deref() == Some("basic") {
            format!("Basic {}", general_purpose::STANDARD.encode(format!("{}:{}", req.email, token)))
        } else if req.auth_type.as_deref() == Some("bearer") {
            format!("Bearer {}", token)
        } else {
            let is_cloud = target_url.contains(".atlassian.net");
            if !is_cloud {
                format!("Bearer {}", token)
            } else {
                format!("Basic {}", general_purpose::STANDARD.encode(format!("{}:{}", req.email, token)))
            }
        }
    };

    request_builder = request_builder
        .header("Authorization", auth_header)
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .header("X-Atlassian-Token", "nocheck");

    if is_tempo {
        request_builder = request_builder.header("X-Tempo-Api-Key", req.api_token.clone());
    }

    if let Some(body) = req.body {
        request_builder = request_builder.json(&body);
    }

    let response = request_builder.send().await.map_err(|e| e.to_string())?;
    let status = response.status();
    
    if status == reqwest::StatusCode::NO_CONTENT {
        return Ok(serde_json::Value::Null);
    }

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Jira Error ({}): {}", status, error_text));
    }

    let data = response.json::<serde_json::Value>().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::default().build())
    .plugin(tauri_plugin_os::init())
    .invoke_handler(tauri::generate_handler![jira_proxy])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
