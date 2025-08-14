import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './main';

describe('frontend smoke', () => {
	it('renders scaffolding without crashing', () => {
		render(<App />);
		expect(screen.getByText(/Suggestions/i)).toBeInTheDocument();
	});
});
