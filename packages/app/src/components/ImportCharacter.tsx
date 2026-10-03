import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { engine, loadEngine } from "../engine/engine.ts";
import { useCharacter } from "../state/character.ts";

/** Opens a character file saved by the old app and shows its sheet. Loads the engine on demand. */
export function ImportCharacter() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    input.value = ""; // so choosing the same file again fires onChange
    setError(null);
    try {
      const text = await file.text();
      await loadEngine();
      useCharacter.getState().load(engine().importCharacter(text).entity);
      navigate("/sheet");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <label className="block">
        Import character file{" "}
        <input type="file" accept=".json,application/json" onChange={onChange} className="block" />
      </label>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
