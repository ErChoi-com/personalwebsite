import './ShinyText.css';

const ShinyText = ({
  text,
  disabled = false,
  speed = 5,
  className = '',
}) => {
  return (
    <span
      className={`shiny-text ${disabled ? 'disabled' : ''} ${className}`}
      style={{ '--shine-speed': `${speed}s` }}
    >
      {text}
    </span>
  );
};

export default ShinyText;
