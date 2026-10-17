import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loadLexicon, type Lexicon } from "./api.ts";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; lexicon: Lexicon };

const LexiconContext = createContext<State>({ status: "loading" });

export function LexiconProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    loadLexicon()
      .then((lexicon) => {
        if (active) setState({ status: "ready", lexicon });
      })
      .catch(() => {
        if (active) setState({ status: "error", message: "Не вдалося завантажити словник. Перевірте з’єднання і спробуйте ще раз." });
      });
    return () => {
      active = false;
    };
  }, []);

  return <LexiconContext.Provider value={state}>{children}</LexiconContext.Provider>;
}

export function useLexicon(): State {
  return useContext(LexiconContext);
}
