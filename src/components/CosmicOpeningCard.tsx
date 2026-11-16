// Inline vector, traced from card-back-v2: the first HTML frame needs no image request.
export function CosmicOpeningCard({ progress }: { progress: number }) {
  return <svg className="cosmic-opening-card" viewBox="0 0 68 116" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth=".18" strokeLinecap="round" strokeLinejoin="round">
    <defs><g id="cosmic-opening-lines">
      <rect pathLength="1" x="1.3" y="1.3" width="65.4" height="113.4" rx="4.4" />
      <rect pathLength="1" x="2.2" y="2.2" width="63.6" height="111.6" rx="3.6" />
      <path pathLength="1" d="M3.1 17V9Q3.1 3.1 17 3.1Q8 3.1 8 8Q3.1 8 3.1 17ZM51 3.1Q64.9 3.1 64.9 9V17Q64.9 8 60 8Q60 3.1 51 3.1ZM3.1 99V107Q3.1 112.9 17 112.9Q8 112.9 8 108Q3.1 108 3.1 99ZM51 112.9Q64.9 112.9 64.9 107V99Q64.9 108 60 108Q60 112.9 51 112.9Z" />
      <path pathLength="1" d="M5.5 3.4L6.1 5.1L7.8 5.7L6.1 6.3L5.5 8L4.9 6.3L3.2 5.7L4.9 5.1ZM62.5 3.4L63.1 5.1L64.8 5.7L63.1 6.3L62.5 8L61.9 6.3L60.2 5.7L61.9 5.1ZM5.5 108L6.1 109.7L7.8 110.3L6.1 110.9L5.5 112.6L4.9 110.9L3.2 110.3L4.9 109.7ZM62.5 108L63.1 109.7L64.8 110.3L63.1 110.9L62.5 112.6L61.9 110.9L60.2 110.3L61.9 109.7Z" />
      <path pathLength="1" d="M28.4 18.5C34.1 18.3 34.1 25.7 28.4 25.5C32.3 24.3 32.3 19.7 28.4 18.5ZM39.6 18.5C33.9 18.3 33.9 25.7 39.6 25.5C35.7 24.3 35.7 19.7 39.6 18.5ZM28.4 83.5C34.1 83.3 34.1 90.7 28.4 90.5C32.3 89.3 32.3 84.7 28.4 83.5ZM39.6 83.5C33.9 83.3 33.9 90.7 39.6 90.5C35.7 89.3 35.7 84.7 39.6 83.5Z" />
      <ellipse pathLength="1" cx="34" cy="54" rx="17" ry="32.5" />
      <ellipse pathLength="1" cx="34" cy="54" rx="27.5" ry="11.2" transform="rotate(35 34 54)" />
      <ellipse pathLength="1" cx="34" cy="54" rx="27.5" ry="11.2" transform="rotate(-35 34 54)" />
      <ellipse pathLength="1" cx="34" cy="54" rx="27.3" ry="12" />
      <circle pathLength="1" cx="34" cy="54" r="19" />
      <circle pathLength="1" cx="34" cy="54" r="18.3" />
      <circle pathLength="1" cx="34" cy="54" r="14.4" />
      <path pathLength="1" d="M34 38L35.7 50L41.8 46.2L38 52.3L50 54L38 55.7L41.8 61.8L35.7 58L34 70L32.3 58L26.2 61.8L30 55.7L18 54L30 52.3L26.2 46.2L32.3 50ZM34 38V70M18 54H50M26.2 46.2L41.8 61.8M41.8 46.2L26.2 61.8" />
      <path pathLength="1" d="M34 5.2V13.8M34 94.2V104M34 13.8L34.5 13L36 13.8L34.5 14.3L34 16L33.5 14.3L32 13.8L33.5 13ZM34 30L34.6 32.2L36.5 33L34.6 33.6L34 35.5L33.4 33.6L31.5 33L33.4 32.2ZM34 72L34.6 74.2L36.5 75L34.6 75.6L34 77.5L33.4 75.6L31.5 75L33.4 74.2ZM34 92L34.5 94L36 94.5L34.5 95L34 97L33.5 95L32 94.5L33.5 94Z" />
      <path pathLength="1" d="M17 39.4a.5.5 0 1 0 0 .01M51 39.4a.5.5 0 1 0 0 .01M17 69a.5.5 0 1 0 0 .01M51 69a.5.5 0 1 0 0 .01M10 53L10.4 54L11.5 54.3L10.4 54.6L10 55.7L9.6 54.6L8.5 54.3L9.6 54ZM58 53L58.4 54L59.5 54.3L58.4 54.6L58 55.7L57.6 54.6L56.5 54.3L57.6 54Z" />
    </g></defs>
    <use href="#cosmic-opening-lines" className="cosmic-opening-track" />
    <use href="#cosmic-opening-lines" className="cosmic-opening-ink" strokeDasharray="1" strokeDashoffset={1 - progress} />
    <path className="cosmic-opening-star" d="M34 48L34.8 52.2L37 51L35.8 53.2L40 54L35.8 54.8L37 57L34.8 55.8L34 60L33.2 55.8L31 57L32.2 54.8L28 54L32.2 53.2L31 51L33.2 52.2Z" />
  </svg>;
}
