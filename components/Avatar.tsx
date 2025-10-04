import Image from 'next/image';
import { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: { wrapper: 'w-6 h-6', text: 'text-xs', px: 24 },
  sm: { wrapper: 'w-8 h-8', text: 'text-sm', px: 32 },
  md: { wrapper: 'w-10 h-10', text: 'text-base', px: 40 },
  lg: { wrapper: 'w-12 h-12', text: 'text-lg', px: 48 },
  xl: { wrapper: 'w-16 h-16', text: 'text-xl', px: 64 },
};

export default function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const colors = [
    'bg-purple-600',
    'bg-blue-600',
    'bg-green-600',
    'bg-orange-600',
    'bg-pink-600',
    'bg-indigo-600',
    'bg-red-600',
    'bg-teal-600',
  ];

  // Générer une couleur basée sur le nom
  const colorIndex = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  const bgColor = colors[colorIndex];

  if (src && !imageError) {
    return (
      <div className={`${sizeClasses[size].wrapper} rounded-full overflow-hidden flex-shrink-0 relative ${className}`}>
        <Image
          src={src}
          alt={name}
          width={sizeClasses[size].px}
          height={sizeClasses[size].px}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses[size].wrapper} ${sizeClasses[size].text} rounded-full ${bgColor} flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`}
    >
      {initials}
    </div>
  );
}
