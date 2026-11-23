export function BarberAddress({ address }: { address: string }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return (
    <a className="muted break-words underline" href={mapsUrl} target="_blank" rel="noopener noreferrer">
      {address}
    </a>
  );
}
