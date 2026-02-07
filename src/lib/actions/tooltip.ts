export function tooltip(node: HTMLElement, text: string | undefined) {
	let tooltipComponent: HTMLElement | null = null;

	function update(newText: string | undefined) {
		text = newText;
		if (tooltipComponent && text) {
			tooltipComponent.textContent = text;
		}
	}

	function positionTooltip() {
		if (!tooltipComponent || !node) return;
		const rect = node.getBoundingClientRect();
		const tooltipRect = tooltipComponent.getBoundingClientRect();

		let top = rect.top - tooltipRect.height - 8;
		let left = rect.left + rect.width / 2 - tooltipRect.width / 2;

		// Prevent going off-screen (basic)
		if (top < 0) top = rect.bottom + 8;
		if (left < 0) left = 8;
		if (left + tooltipRect.width > window.innerWidth)
			left = window.innerWidth - tooltipRect.width - 8;

		tooltipComponent.style.top = `${top}px`;
		tooltipComponent.style.left = `${left}px`;
	}

	function mouseEnter() {
		if (!text) return;

		tooltipComponent = document.createElement('div');
		tooltipComponent.textContent = text;
		tooltipComponent.className = `
			fixed z-[9999] px-3 py-1.5 text-xs font-medium text-white 
			bg-slate-900/95 backdrop-blur-sm rounded-lg shadow-xl shadow-black/20 
			border border-slate-700/50 pointer-events-none 
			transition-all duration-200 opacity-0 translate-y-1
		`;
		document.body.appendChild(tooltipComponent);

		positionTooltip();

		// Animate in
		requestAnimationFrame(() => {
			if (tooltipComponent) {
				tooltipComponent.style.opacity = '1';
				tooltipComponent.style.transform = 'translateY(0)';
			}
		});
	}

	function mouseLeave() {
		if (tooltipComponent) {
			tooltipComponent.style.opacity = '0';
			tooltipComponent.style.transform = 'translateY(1px)';
			setTimeout(() => {
				if (tooltipComponent && tooltipComponent.parentNode) {
					tooltipComponent.remove();
				}
				tooltipComponent = null;
			}, 200);
		}
	}

	node.addEventListener('mouseenter', mouseEnter);
	node.addEventListener('mouseleave', mouseLeave);

	// Remove native title if present to avoid double tooltips
	const originalTitle = node.getAttribute('title');
	if (originalTitle) node.removeAttribute('title');

	return {
		update,
		destroy() {
			node.removeEventListener('mouseenter', mouseEnter);
			node.removeEventListener('mouseleave', mouseLeave);
			if (tooltipComponent && tooltipComponent.parentNode) {
				tooltipComponent.remove();
			}
			if (originalTitle) node.setAttribute('title', originalTitle);
		}
	};
}
