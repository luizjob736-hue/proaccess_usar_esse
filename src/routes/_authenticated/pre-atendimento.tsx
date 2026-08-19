import { createFileRoute } from "@tanstack/react-router";
import { MatrizView } from "./matriz-acessos";

export const Route = createFileRoute("/_authenticated/pre-atendimento")({
  component: PreAtendimento,
});

function PreAtendimento() {
  return <MatrizView onlyPreAtendimento />;
}
