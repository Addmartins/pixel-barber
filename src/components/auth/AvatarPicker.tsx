import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { avatars, type AvatarId } from "@/lib/avatars";
import type { EquippedCosmetic } from "@/lib/store";

export function AvatarPicker({ value, onChange, cosmetics }: {
  value: AvatarId;
  onChange: (avatar: AvatarId) => void;
  cosmetics?: EquippedCosmetic[];
}) {
  return (
    <fieldset>
      <legend className="mb-2 font-semibold">Escolha seu avatar</legend>
      <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-4">
        {avatars.map((option) => (
          <label key={option.id} className="avatar-option">
            <input className="sr-only" type="radio" name="avatar" value={option.id}
              checked={value === option.id} onChange={() => onChange(option.id)} />
            <span className="avatar-card">
              <AvatarRenderer skinId={option.id} cosmetics={cosmetics} />
              <span>{option.name}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
