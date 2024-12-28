"use client"

import {Spinner} from "@nextui-org/react";

export default function LoadingPage() {
  return (
    <div className="fixed inset-0 flex items-center justify-center min-h-screen bg-background/70 dark:bg-background/80">
      <Spinner 
        size="lg"
        classNames={{
          circle1: "border-3",
          circle2: "border-3"
        }}
      />
    </div>
  );
}