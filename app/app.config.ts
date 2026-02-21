export default defineAppConfig({
  ui: {
    // ── Semantic color palette ────────────────────────────────────────────────
    // primary  → indigo/violet (brand, main CTAs, active states)
    // secondary → violet (complementary actions)
    // warning  → amber (stand-out elements, host actions, emphasis)
    // neutral  → slate (matches existing dark UI palette)
    colors: {
      primary: "violet",
      secondary: "indigo",
      neutral: "slate",
    },

    // ── Modal ─────────────────────────────────────────────────────────────────
    // Backdrop blur instead of a dark overlay. The overlay is enabled but
    // styled to be a blur layer rather than a flat dimmed mask.
    modal: {
      slots: {
        overlay: "fixed inset-0 backdrop-blur-md bg-slate-950/60",
        content: [
          "bg-slate-900/95 divide-y divide-slate-700/50",
          "flex flex-col focus:outline-none",
          "ring ring-slate-700/50 shadow-2xl shadow-black/60",
        ].join(" "),
        header: "flex items-center gap-1.5 p-4 sm:px-6 min-h-16",
        body: "flex-1 p-4 sm:p-6",
        footer: "flex items-center gap-1.5 p-4 sm:px-6",
        title:
          "text-slate-100 font-semibold font-[Bebas_Neue] text-2xl tracking-wide",
        description: "mt-1 text-slate-400 text-sm",
        close:
          "absolute top-4 end-4 text-slate-400 hover:text-slate-200 transition-colors",
      },
      variants: {
        transition: {
          true: {
            overlay:
              "data-[state=open]:animate-[fade-in_150ms_ease-out] data-[state=closed]:animate-[fade-out_150ms_ease-in]",
            content:
              "data-[state=open]:animate-[scale-in_200ms_ease-out] data-[state=closed]:animate-[scale-out_200ms_ease-in]",
          },
        },
        fullscreen: {
          false: {
            content: "w-[calc(100vw-2rem)] max-w-lg rounded-xl shadow-2xl",
          },
        },
        // Always apply the blurred backdrop. The false variant is a
        // defensive fallback in case any consumer forgets to set overlay=true.
        overlay: {
          true: {
            overlay: "bg-slate-950/60",
          },
          false: {
            overlay: "bg-slate-950/40",
          },
        },
      },
    },

    // ── Slideover ─────────────────────────────────────────────────────────────
    slideover: {
      slots: {
        overlay: "fixed inset-0 backdrop-blur-sm bg-slate-950/50",
        content: [
          "bg-slate-900 divide-y divide-slate-700/50",
          "flex flex-col focus:outline-none",
          "ring ring-slate-700/50",
        ].join(" "),
        header: "flex items-center gap-1.5 p-4 sm:px-6 min-h-16",
        body: "flex-1 p-4 sm:p-6 overflow-y-auto",
        title:
          "text-slate-100 font-semibold font-[Bebas_Neue] text-2xl tracking-wide",
        description: "mt-1 text-slate-400 text-sm",
        close:
          "absolute top-4 end-4 text-slate-400 hover:text-slate-200 transition-colors",
      },
    },

    // ── Button ────────────────────────────────────────────────────────────────
    button: {
      slots: {
        base: [
          "rounded-lg font-medium inline-flex items-center",
          "disabled:cursor-not-allowed aria-disabled:cursor-not-allowed",
          "disabled:opacity-50 aria-disabled:opacity-50",
          "transition-all duration-200",
        ].join(" "),
      },
      defaultVariants: {
        color: "primary",
        variant: "subtle",
        size: "md",
      },
    },

    // ── Popover ───────────────────────────────────────────────────────────────
    popover: {
      slots: {
        content:
          "backdrop-blur-md bg-slate-900/90 ring ring-slate-700/50 rounded-xl shadow-xl shadow-black/50",
        arrow: "fill-slate-900",
      },
    },

    // ── Tooltip ───────────────────────────────────────────────────────────────
    tooltip: {
      slots: {
        content:
          "bg-slate-800 text-slate-200 ring ring-slate-700/50 text-xs px-2 py-1 rounded-md shadow-lg",
        arrow: "fill-slate-800",
      },
    },

    // ── Avatar ────────────────────────────────────────────────────────────────
    avatar: {
      slots: {
        root: "ring-2 ring-slate-700/50",
        fallback: "bg-slate-700 text-slate-300 font-[Bebas_Neue]",
      },
    },

    // ── Badge ─────────────────────────────────────────────────────────────────
    badge: {
      slots: {
        base: "font-[Bebas_Neue] tracking-wide",
      },
    },

    // ── Separator ─────────────────────────────────────────────────────────────
    separator: {
      slots: {
        border: "border-slate-700/50",
      },
    },

    // ── Input ─────────────────────────────────────────────────────────────────
    input: {
      slots: {
        root: "w-full",
        base: [
          "bg-slate-800/80 ring ring-slate-600/50",
          "text-slate-100 placeholder-slate-500",
          "focus:ring-violet-500/50 focus:bg-slate-800",
          "rounded-lg transition-all duration-200",
        ].join(" "),
      },
    },

    // ── Select ────────────────────────────────────────────────────────────────
    select: {
      slots: {
        base: [
          "bg-slate-800/80 ring ring-slate-600/50",
          "text-slate-100",
          "focus:ring-violet-500/50",
          "rounded-lg transition-all duration-200",
        ].join(" "),
        content: "bg-slate-900 ring ring-slate-700/50 rounded-xl shadow-xl",
        option:
          "text-slate-200 hover:bg-slate-700/50 data-highlighted:bg-slate-700/50",
      },
    },

    // ── Toast (notifications) ─────────────────────────────────────────────────
    toast: {
      slots: {
        root: [
          "bg-slate-800/95 ring ring-slate-700/50",
          "backdrop-blur-md rounded-xl shadow-2xl shadow-black/50",
        ].join(" "),
        title: "text-slate-100 font-semibold",
        description: "text-slate-400",
      },
    },
  },
});
