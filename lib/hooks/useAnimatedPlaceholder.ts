import { useState, useEffect } from "react";

export function useAnimatedPlaceholder(phrases: string[], prefix: string = "Ask ProxNet for ") {
  const [placeholder, setPlaceholder] = useState("");

  useEffect(() => {
    if (!phrases || phrases.length === 0) return;
    
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let timeout: NodeJS.Timeout;

    const tick = () => {
      const currentPhrase = phrases[phraseIndex];
      const fullText = prefix + currentPhrase;

      if (!isDeleting) {
        setPlaceholder(fullText.substring(0, prefix.length + charIndex + 1));
        charIndex++;

        if (charIndex === currentPhrase.length) {
          timeout = setTimeout(() => {
            isDeleting = true;
            tick();
          }, 2000);
          return;
        }
      } else {
        setPlaceholder(fullText.substring(0, prefix.length + charIndex - 1));
        charIndex--;

        if (charIndex === 0) {
          isDeleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
        }
      }

      const delta = isDeleting ? 30 : 60;
      timeout = setTimeout(tick, delta);
    };

    tick();
    return () => clearTimeout(timeout);
  }, [phrases, prefix]);

  return placeholder;
}
