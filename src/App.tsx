/**
 * Casca mínima. A interface de verdade entra na fase 3; aqui só existe o
 * suficiente para o Vite servir a página e o middleware responder.
 */
export function App() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">OpenCode Monitor</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Dashboard em construção. A camada de dados e o endpoint já respondem; a interface entra na
        fase 3.
      </p>
    </main>
  );
}
