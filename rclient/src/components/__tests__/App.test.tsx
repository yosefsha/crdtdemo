import React, { act } from 'react';
import { render, screen } from '@testing-library/react';
import App from '../App';
import ReactDOM from 'react-dom/client';

it('renders learn react link', () => {
  render(<App />);
  const linkElement = screen.getByText(/Comment:/i);
  act(() => {
  expect(linkElement).toBeInTheDocument();
  });
});

it('should render', () => {
  // this test should create a new div and render the app
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = ReactDOM.createRoot(div)
  act(() => {
  root.render(<App />);
  }); 
  //clear the div
  document.body.removeChild(div);

});