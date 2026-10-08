/** The light in the room: two torches below, drowned light above, and a vignette over everything. */
export function Gloom() {
  return (
    <>
      <div className="gloom" aria-hidden>
        <div className="torch l" />
        <div className="torch r" />
        <div className="drown" />
      </div>
      <div className="vignette" aria-hidden />
    </>
  );
}
