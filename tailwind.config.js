import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {}
	},
	plugins: [forms, typography, tailwindcssAnimate]
};
