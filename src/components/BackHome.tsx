// The way back to the home page from the smaller pages (/offline, 404).
export function BackHome() {
  return (
    <a className="small" href="/">
      <span aria-hidden="true">←</span> back to kish’s corner
    </a>
  )
}
