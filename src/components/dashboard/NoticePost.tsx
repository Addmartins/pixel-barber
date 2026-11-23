import { useEffect, useState } from "react";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { clubDateTime, muralBucket, type ClubNotice } from "@/lib/club";
import { getSupabase } from "@/lib/supabase/browser";

export function NoticePost({ notice }: { notice: ClubNotice }) {
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!notice.photo_paths.length) return;
    let active = true;
    void (async () => {
      try {
        const result = await getSupabase()?.storage.from(muralBucket).createSignedUrls(notice.photo_paths, 3600);
        if (!active) return;
        const entries = result?.data?.flatMap((photo) =>
          photo.path && photo.signedUrl ? [[photo.path, photo.signedUrl]] : []) ?? [];
        setPhotos(Object.fromEntries(entries));
        setError(entries.length !== notice.photo_paths.length);
      } catch { if (active) setError(true); }
    })();
    return () => { active = false; };
  }, [notice.photo_paths]);

  return (
    <>
      <h3 className="font-semibold">{notice.title}</h3>
      <time className="muted text-xs" dateTime={notice.created_at}>{clubDateTime.format(new Date(notice.created_at))}</time>
      {notice.tagged_avatar && <p className="mt-2 flex items-center gap-2 text-sm">
        <AvatarRenderer skinId={notice.tagged_avatar} size={32} />
        <span>{notice.tagged_name}</span>
      </p>}
      {notice.photo_paths.length > 0 && <div className={notice.photo_paths.length > 1 ? "mt-2 grid grid-cols-2 gap-2" : "mt-2"}>
        {notice.photo_paths.map((path, index) => photos[path] && (
          // Private photos are loaded through the authenticated Storage client.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="max-h-96 w-full rounded-lg object-contain" key={path} src={photos[path]} loading="lazy" decoding="async"
            alt={notice.title + (notice.photo_paths.length > 1 ? ` — foto ${index + 1}` : "")} />
        ))}
      </div>}
      {error && <p className="muted text-sm">Algumas fotos não puderam ser carregadas.</p>}
      {notice.body && <p className="mt-2 whitespace-pre-wrap break-words">{notice.body}</p>}
    </>
  );
}
