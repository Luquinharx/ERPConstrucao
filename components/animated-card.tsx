"use client"

import type React from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface AnimatedCardProps {
  children: React.ReactNode
  className?: string
  delay?: number
  animation?: "fade" | "slide" | "scale" | "bounce"
}

export function AnimatedCard({ children, className = "", delay = 0, animation = "fade" }: AnimatedCardProps) {
  const animationClass = {
    fade: "animate-fade-in",
    slide: "animate-slide-in",
    scale: "scale-hover",
    bounce: "bounce-soft",
  }[animation]

  return (
    <Card
      className={cn(animationClass, "dynamic-shadow shine-effect", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </Card>
  )
}
