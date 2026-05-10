import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-rose-50 to-white text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-rose-900">
        Dra. Juliana Pereira
      </h1>
      <p className="mt-3 text-rose-700/80 max-w-md">
        Odontologia estética em São Paulo — lentes, clareamento e harmonização do
        sorriso.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/quiz"
          className="inline-flex items-center rounded-md bg-rose-700 px-5 py-3 text-sm font-medium text-white hover:bg-rose-800"
        >
          Descobrir meu tratamento
        </Link>
      </div>
    </main>
  );
}
