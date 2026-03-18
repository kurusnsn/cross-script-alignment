import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className, size = 32 }) => {
  // Original width/height is 300/250. Let's calculate the ratio.
  const aspectRatio = 300 / 250;
  const height = size;
  const width = size * aspectRatio;

  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 300 250" 
      xmlns="http://www.w3.org/2000/svg"
      className={`group ${className || ''}`}
    >
      {/* Group for the Bubbles centered in the viewbox */}
      <g transform="translate(60, 45)">
          
          {/* Back Bubble (Teal Background - Seamless Path) */}
          <g transform="translate(0, 0)">
              <g className="transition-transform duration-300 ease-in-out group-hover:scale-110 group-hover:-translate-y-2 group-hover:-translate-x-2" style={{ transformOrigin: '52.5px 45px' }}>
                {/* Moved tail to x=25-45 to avoid collision with corner radius at x=20 */}
                <path d="M 20 0 
                         H 85 
                         A 20 20 0 0 1 105 20 
                         V 70 
                         A 20 20 0 0 1 85 90 
                         H 45 
                         L 35 110 
                         L 25 90 
                         H 20 
                         A 20 20 0 0 1 0 70 
                         V 20 
                         A 20 20 0 0 1 20 0 
                         Z" fill="#2DD4BF" stroke="#2DD4BF" strokeWidth="3" strokeLinejoin="round"></path>
                {/* Character 'A' */}
                <text x="52.5" y="62" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="54" fill="white" textAnchor="middle">A</text>
              </g>
          </g>

          {/* Front Bubble (White Background + Teal Border - Seamless Path) */}
          <g transform="translate(70, 45)">
              <g className="transition-transform duration-300 ease-in-out group-hover:scale-110 group-hover:translate-x-2 group-hover:translate-y-2" style={{ transformOrigin: '52.5px 45px' }}>
                {/* Combined Path for a Solid Border */}
                <path d="M 20 0 
                         H 85 
                         A 20 20 0 0 1 105 20 
                         V 70 
                         A 20 20 0 0 1 85 90 
                         H 80 
                         L 70 110 
                         L 60 90 
                         H 20 
                         A 20 20 0 0 1 0 70 
                         V 20 
                         A 20 20 0 0 1 20 0 
                         Z" fill="white" stroke="#2DD4BF" strokeWidth="3" strokeLinejoin="round"></path>
                
                {/* Character '文' (Teal) */}
                <text x="52.5" y="65" fontFamily="'Noto Sans SC', 'STHeiti', 'PingFang SC', sans-serif" fontWeight="bold" fontSize="52" fill="#2DD4BF" textAnchor="middle">文</text>
              </g>
          </g>
      </g>
    </svg>
  );
};
