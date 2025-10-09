import { render, screen } from '@testing-library/react';
import Avatar from '../Avatar';

describe('Avatar Component', () => {
  it('should render initials when no image is provided', () => {
    render(<Avatar name="John Doe" />);

    const avatar = screen.getByText('JD');
    expect(avatar).toBeInTheDocument();
  });

  it('should render initials from single word name', () => {
    render(<Avatar name="John" />);

    const avatar = screen.getByText('J');
    expect(avatar).toBeInTheDocument();
  });

  it('should render only first 2 initials for long names', () => {
    render(<Avatar name="John Paul George Ringo" />);

    const avatar = screen.getByText('JP');
    expect(avatar).toBeInTheDocument();
  });

  it('should apply correct size classes', () => {
    const { container } = render(<Avatar name="John Doe" size="lg" />);

    const avatarDiv = container.querySelector('div');
    expect(avatarDiv).toHaveClass('w-12', 'h-12', 'text-lg');
  });

  it('should apply custom className', () => {
    const { container } = render(<Avatar name="John Doe" className="custom-class" />);

    const avatarDiv = container.querySelector('div');
    expect(avatarDiv).toHaveClass('custom-class');
  });

  it('should render image when src is provided', () => {
    render(<Avatar name="John Doe" src="/test-avatar.jpg" />);

    const img = screen.getByAltText('John Doe');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src');
  });

  it('should generate consistent colors for same name', () => {
    const { container: container1 } = render(<Avatar name="John Doe" />);
    const { container: container2 } = render(<Avatar name="John Doe" />);

    const div1 = container1.querySelector('div');
    const div2 = container2.querySelector('div');

    // Both should have the same background color class
    const bgClass1 = Array.from(div1?.classList || []).find(cls => cls.startsWith('bg-'));
    const bgClass2 = Array.from(div2?.classList || []).find(cls => cls.startsWith('bg-'));

    expect(bgClass1).toBe(bgClass2);
  });
});
