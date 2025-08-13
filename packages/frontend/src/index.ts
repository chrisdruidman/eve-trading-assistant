export const placeholder = 'frontend-ready';
// Export types/helpers without running DOM code under test environment
if (typeof window !== 'undefined') {
	await import('./main');
}
