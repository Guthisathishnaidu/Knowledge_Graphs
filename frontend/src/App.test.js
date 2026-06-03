import { render, screen } from '@testing-library/react';
import App from './App';

// FIX: old test checked "learn react" which doesn't exist in this app
test('renders GraphMind brand', () => {
  render(<App />);
  const brand = screen.getByText(/graph/i);
  expect(brand).toBeInTheDocument();
});

test('renders search input placeholder', () => {
  render(<App />);
  const input = screen.getByPlaceholderText(/ask a business question/i);
  expect(input).toBeInTheDocument();
});

test('renders Run Query button', () => {
  render(<App />);
  const btn = screen.getByText(/run query/i);
  expect(btn).toBeInTheDocument();
});