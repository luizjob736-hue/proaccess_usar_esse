import { createFileRoute } from "@tanstack/react-router";
import { MatrizView } from "./matriz-acessos";

export const Route = createFileRoute("/_authenticated/inativos")({ component: Inativos });

function Inativos() {
  return <MatrizView onlyInativos />;
}
