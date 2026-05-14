import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Mad Saves app', () => {
  render(<App />);
  const title = screen.getByText(/MAD SAVES/i);
  expect(title).toBeInTheDocument();
});
