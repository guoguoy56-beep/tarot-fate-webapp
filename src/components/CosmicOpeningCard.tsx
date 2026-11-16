// An original stargate motif, inline so the first HTML frame needs no image request.
export function CosmicOpeningCard({ progress }: { progress: number }) {
  return <svg className="cosmic-opening-card" viewBox="0 0 68 116" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth=".28" strokeLinecap="round" strokeLinejoin="round">
    <defs><g id="cosmic-opening-lines">
      <path pathLength="1" d="M13 3H55L64 12V104L55 113H13L4 104V12Z" />
      <path pathLength="1" d="M10 23V14L16 8H25M43 8H52L58 14V23M10 93V102L16 108H25M43 108H52L58 102V93" />
      <path pathLength="1" d="M15 83V45C15 32 23 23 34 16C45 23 53 32 53 45V83M21 81V46C21 37 26 30 34 24C42 30 47 37 47 46V81" />
      <path pathLength="1" d="M15 45L21 46M34 16V24M53 45L47 46M15 83L21 81H47L53 83M21 81L16 87H52L47 81M16 87L11 94H57L52 87M11 94L7 102H61L57 94" />
      <path pathLength="1" d="M34 38L36.8 49.2L44 52L36.8 54.8L34 66L31.2 54.8L24 52L31.2 49.2ZM34 38V66M24 52H44" />
      <path pathLength="1" d="M34 30V33M24 35L26 38M44 35L42 38M19 53H21M47 53H49M24 70L26 67M44 70L42 67M34 72V76" />
      <path pathLength="1" d="M34 7L36 10L34 13L32 10ZM34 104L36 107L34 110L32 107ZM8 49L10 52L8 55L6 52ZM60 49L62 52L60 55L58 52Z" />
      <path pathLength="1" d="M11 33H13M55 33H57M11 71H13M55 71H57M28 91H40M25 98H43" />
    </g></defs>
    <use href="#cosmic-opening-lines" className="cosmic-opening-track" />
    <use href="#cosmic-opening-lines" className="cosmic-opening-ink" strokeDasharray="1" strokeDashoffset={1 - progress} />
    <path className="cosmic-opening-star" d="M34 44L35.6 50.4L40 52L35.6 53.6L34 60L32.4 53.6L28 52L32.4 50.4Z" />
  </svg>;
}
