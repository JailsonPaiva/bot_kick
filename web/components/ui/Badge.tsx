type BadgeVariant = 'green' | 'red' | 'blue' | 'yellow' | 'purple' | 'gray' | 'cyan'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  green: 'bg-green-900/60 text-green-300 border-green-700',
  red: 'bg-red-900/60 text-red-300 border-red-700',
  blue: 'bg-blue-900/60 text-blue-300 border-blue-700',
  yellow: 'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  purple: 'bg-purple-900/60 text-purple-300 border-purple-700',
  gray: 'bg-gray-800 text-gray-300 border-gray-600',
  cyan: 'bg-cyan-900/60 text-cyan-300 border-cyan-700',
}

export function Badge({ children, variant = 'gray', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
