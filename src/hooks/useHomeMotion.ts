import { useLayoutEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Motion system for the public landing page. Everything is scoped to the page
 * root so route changes and React StrictMode can cleanly revert animations.
 */
export function useHomeMotion(scope: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (prefersReducedMotion) return;

    const context = gsap.context(() => {
      const heroTimeline = gsap.timeline({
        defaults: { ease: 'power3.out' },
      });

      heroTimeline
        .from('[data-hero-backdrop] img', {
          autoAlpha: 0,
          scale: 1.1,
          duration: 1.6,
          ease: 'power2.out',
        })
        .from(
          '[data-hero-reveal]',
          {
            autoAlpha: 0,
            y: 34,
            duration: 0.9,
            stagger: 0.1,
          },
          0.12,
        )
        .from(
          '[data-hero-frame]',
          {
            autoAlpha: 0,
            x: 72,
            y: 30,
            scale: 0.92,
            duration: 1.05,
            stagger: 0.1,
            ease: 'back.out(1.35)',
          },
          0.28,
        )
        .from(
          '[data-hero-scroll]',
          { autoAlpha: 0, y: -12, duration: 0.6 },
          0.95,
        );

      gsap.to('[data-hero-backdrop] img', {
        yPercent: 10,
        scale: 1.06,
        ease: 'none',
        scrollTrigger: {
          trigger: '[data-home-hero]',
          start: 'top top',
          end: 'bottom top',
          scrub: 0.8,
        },
      });

      const marquee = root.querySelector<HTMLElement>('[data-marquee-track]');
      if (marquee) {
        gsap.to(marquee, {
          xPercent: -50,
          duration: 28,
          repeat: -1,
          ease: 'none',
        });
      }

      gsap.utils
        .toArray<HTMLElement>('[data-reveal-section]')
        .forEach((section) => {
          const heading = section.querySelectorAll<HTMLElement>(
            '[data-reveal-heading]',
          );
          const items = section.querySelectorAll<HTMLElement>(
            '[data-reveal-item]',
          );

          if (heading.length) {
            gsap.from(heading, {
              autoAlpha: 0,
              y: 30,
              duration: 0.8,
              stagger: 0.08,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: section,
                start: 'top 78%',
                once: true,
              },
            });
          }

          if (items.length) {
            gsap.from(items, {
              autoAlpha: 0,
              y: 46,
              scale: 0.975,
              duration: 0.85,
              stagger: 0.09,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: items[0],
                start: 'top 86%',
                once: true,
              },
            });
          }
        });

      root.querySelectorAll<HTMLElement>('[data-counter]').forEach((node) => {
        const original = node.textContent?.trim() ?? '';
        const match = original.match(/^(\d+(?:[.,]\d+)?)(.*)$/);
        if (!match) return;

        const target = Number(match[1].replace(',', '.'));
        const suffix = match[2];
        const state = { value: 0 };

        gsap.to(state, {
          value: target,
          duration: 1.55,
          ease: 'power2.out',
          snap: { value: Number.isInteger(target) ? 1 : 0.1 },
          onUpdate: () => {
            node.textContent = `${state.value}${suffix}`;
          },
          scrollTrigger: {
            trigger: node,
            start: 'top 88%',
            once: true,
          },
        });
      });
    }, root);

    return () => context.revert();
  }, [scope]);
}
