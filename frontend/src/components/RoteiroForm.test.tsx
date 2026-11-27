import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { DESTINOS_PADRAO } from "../services/geolocation.ts";
import { RoteiroForm } from "./RoteiroForm.tsx";

describe("RoteiroForm", () => {
  it("permite alternar para 100% Elétrico, ajustar parâmetros e enviar payload válido", async () => {
    const user = userEvent.setup();
    const onPlanejar = vi.fn().mockResolvedValue(undefined);
    const onCancelar = vi.fn();

    render(
      <RoteiroForm
        destinosCatalogo={DESTINOS_PADRAO}
        planejando={false}
        onPlanejar={onPlanejar}
        onCancelar={onCancelar}
      />,
    );

    await user.click(screen.getByRole("radio", { name: /100% Elétrico/i }));
    await user.click(screen.getByRole("button", { name: /Personalizar Parâmetros/i }));
    expect(screen.getByLabelText(/Eficiência \(km\/kWh\)/i)).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "3 dias" }));
    await user.click(screen.getByRole("button", { name: /Planejar Viagem/i }));

    expect(onPlanejar).toHaveBeenCalledTimes(1);
    const payload = onPlanejar.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      origem_cidade: "Piripiri",
      origem_uf: "PI",
      destino_cidade: "Natal",
      destino_uf: "RN",
      dias_estadia: 3,
      veiculo: { propulsao: "eletrico" },
    });
  });

  it("bloqueia envio idempotente e exibe botão Cancelar durante o carregamento", async () => {
    const user = userEvent.setup();
    const onPlanejar = vi.fn().mockResolvedValue(undefined);
    const onCancelar = vi.fn();

    render(
      <RoteiroForm
        destinosCatalogo={DESTINOS_PADRAO}
        planejando={true}
        onPlanejar={onPlanejar}
        onCancelar={onCancelar}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /Planejando Viagem/i });
    expect(submitBtn).toBeDisabled();

    const cancelBtn = screen.getByRole("button", { name: /Cancelar/i });
    await user.click(cancelBtn);
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });

  it("aplica sugestão Haversine (>400 km) ao clicar no chip", async () => {
    const user = userEvent.setup();
    const onPlanejar = vi.fn().mockResolvedValue(undefined);

    render(
      <RoteiroForm
        destinosCatalogo={DESTINOS_PADRAO}
        planejando={false}
        onPlanejar={onPlanejar}
        onCancelar={vi.fn()}
      />,
    );

    const sugestaoBtn = screen.getByRole("button", { name: /Juazeiro do Norte \(CE\)/i });
    await user.click(sugestaoBtn);

    expect(screen.getByLabelText(/Cidade de Destino/i)).toHaveValue("Juazeiro do Norte");
  });
});
