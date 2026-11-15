import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import { Slot } from 'radix-ui';

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all duration-200 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:scale-95 disabled:pointer-events-none disabled:opacity-35 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/40 dark:aria-invalid:border-destructive/70 dark:aria-invalid:ring-destructive/60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 uppercase tracking-wide",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/85 hover:shadow-lg shadow-md',
        accent: 'bg-accent text-accent-foreground hover:bg-accent/85 hover:shadow-lg shadow-md',
        outline:
          'border-2 border-primary text-primary bg-transparent hover:bg-primary/10 aria-expanded:bg-primary/15',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/85 shadow-sm',
        ghost: 'hover:bg-primary/20 text-foreground aria-expanded:bg-primary/30',
        destructive: 'bg-destructive text-white hover:bg-destructive/85 hover:shadow-lg shadow-md',
        link: 'text-primary hover:text-accent underline-offset-4 hover:underline font-bold',
      },
      size: {
        default:
          'h-11 gap-2 px-6 text-xs has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5',
        xs: "h-8 gap-1 px-3 text-[0.65rem] in-data-[slot=button-group]:rounded-none has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-4 text-[0.75rem] in-data-[slot=button-group]:rounded-none has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-12 gap-3 px-8 text-sm has-data-[icon=inline-end]:pr-6 has-data-[icon=inline-start]:pl-6',
        icon: 'size-11',
        'icon-xs':
          "size-8 in-data-[slot=button-group]:rounded-none [&_svg:not([class*='size-'])]:size-4",
        'icon-sm': 'size-9 in-data-[slot=button-group]:rounded-none',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
