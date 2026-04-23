import { useEffect, useState } from "react";

import { friendlyError } from "../../lib/friendlyError";
import { supabase } from "../../lib/supabase";
import { ThemeLoader } from "../../shared/components/ThemeLoader";
import "./UpdatesScreen.css";

type Update = {
  id: string;
  published_on: string;
  title: string;
  body: string;
};

export function UpdatesScreen() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadUpdates() {
      if (!supabase) {
        setError("We could not load updates right now. Please try again shortly.");
        setLoading(false);
        return;
      }

      const { data, error: loadError } = await supabase.from("updates").select("id,published_on,title,body").eq("published", true).order("published_on", { ascending: false });

      if (!mounted) return;

      if (loadError) {
        setError(friendlyError(loadError, "We could not load updates right now. Please try again."));
      }

      setUpdates((data as Update[] | null) ?? []);
      setLoading(false);
    }

    loadUpdates();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="updates-page">
      <section className="container updates-shell" aria-labelledby="updates-title">
        <div className="updates-head">
          <h1 className="font-display" id="updates-title">Updates</h1>
          <p>News and operational updates from Student Trips SA.</p>
        </div>

        {loading ? <div className="app-empty-state"><ThemeLoader label="Loading updates" /><p>Loading updates...</p></div> : null}
        {error && !loading ? <div className="app-empty-state"><h2>Updates could not load</h2><p>{error}</p></div> : null}
        {!loading && !error && updates.length === 0 ? <div className="app-empty-state"><h2>No updates right now</h2><p>Important trip news and announcements will be shared here.</p></div> : null}

        <div className="updates-list">
          {updates.map((item) => (
            <article className="updates-card" key={item.id}>
              <time dateTime={item.published_on}>{item.published_on.replaceAll("-", "/")}</time>
              <h2 className="font-display">{item.title}</h2>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
