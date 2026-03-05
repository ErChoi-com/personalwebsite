import './GradientText.css';

export default function GradientText({
  children,
  className = '',
  colors = ['#6366f1', '#a855f7', '#ec4899', '#6366f1'],
  animationSpeed = 8,
  showBorder = false,
}) {
  const gradientStyle = {
    backgroundImage: `linear-gradient(to right, ${colors.join(', ')})`,
    animationDuration: `${animationSpeed}s`,
  };

  return (
    <span className={`gradient-text-animated ${showBorder ? 'with-border' : ''} ${className}`}>
      <span className="gradient-text-inner" style={gradientStyle}>
        {children}
      </span>
    </span>
  );
}
