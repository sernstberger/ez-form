import { render, screen } from '@testing-library/react'
import Button from '@mui/material/Button'

test('MUI renders in jsdom', () => {
  render(<Button>Hello</Button>)
  expect(screen.getByRole('button', { name: 'Hello' })).toBeInTheDocument()
})
