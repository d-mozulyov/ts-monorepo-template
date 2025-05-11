import { describe, it, expect } from 'vitest';
import App from '../src/App.svelte';

describe('App.svelte', () => {
    it('has correct page title', () => {
        const target = document.createElement('div');
        document.body.appendChild(target);

        new App({ target });

        const heading = document.querySelector('h1');
        expect(heading?.textContent).toBe('Vite + Svelte');

        document.body.removeChild(target);
    });
});