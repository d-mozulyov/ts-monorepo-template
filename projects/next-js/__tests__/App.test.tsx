import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';  // Import to extend Jest matchers
import Home from '../src/app/page';  // Adjust the path as necessary

describe('Home Page', () => {
  it('renders the home page with expected text', () => {
    render(<Home />);
    const headingElement = screen.getByText(/Get started by editing/i);
    expect(headingElement).toBeInTheDocument();
  });
});