"use client";

import { QuestionForm } from "@/components/qa/QuestionForm";
import { QuestionList } from "@/components/qa/QuestionList";
import { useState } from "react";

export default function QAPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Q&A</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Ask questions anonymously to relevant professionals in your area.
        </p>
      </div>
      <QuestionForm onPosted={() => setRefreshKey((k) => k + 1)} />
      <QuestionList key={refreshKey} />
    </div>
  );
}
