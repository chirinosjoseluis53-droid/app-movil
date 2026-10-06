import {
  calcularPrestamo,
  deudaTotal,
  mensajeWhatsApp,
  telefonoWhatsApp,
  linkWhatsApp,
  diasEntre,
  sumarDias,
  hashPassword,
  verifyPassword,
  monedaValida,
} from "../lib/helpers";

const SIN_MORA = { tasaMora: 0, recargo: 0, diasGracia: 3 };
const HOY = "2026-09-29";

describe("deudaTotal", () => {
  it("aplica el % como interés total del préstamo", () => {
    expect(deudaTotal(100, 10)).toBe(110);
    expect(deudaTotal(1000, 0)).toBe(1000);
    expect(deudaTotal(500, 5)).toBe(525);
  });

  it("redondea a 2 decimales", () => {
    expect(deudaTotal(333, 7.5)).toBe(357.98);
  });
});

describe("calcularPrestamo", () => {
  it("saldo = deuda − pagos", () => {
    const r = calcularPrestamo(100, 10, 40, "2026-10-29", "activo", HOY, SIN_MORA);
    expect(r.deudaTotal).toBe(110);
    expect(r.saldo).toBe(70);
    expect(r.estadoCalc).toBe("activo");
  });

  it("queda pagado cuando los pagos cubren la deuda", () => {
    const r = calcularPrestamo(100, 10, 110, "2026-10-29", "activo", HOY, SIN_MORA);
    expect(r.saldo).toBe(0);
    expect(r.estadoCalc).toBe("pagado");
  });

  it("marca atrasado solo si venció y debe saldo", () => {
    const vencido = calcularPrestamo(100, 10, 0, "2026-09-01", "activo", HOY, SIN_MORA);
    expect(vencido.estadoCalc).toBe("atrasado");
    expect(vencido.diasVencido).toBe(28);

    const saldado = calcularPrestamo(100, 10, 110, "2026-09-01", "activo", HOY, SIN_MORA);
    expect(saldado.estadoCalc).toBe("pagado");
    expect(saldado.diasVencido).toBe(0);
  });

  it("no cobra mora durante los días de gracia", () => {
    // Vencido hace 3 días = exactamente los días de gracia.
    const r = calcularPrestamo(100, 10, 0, "2026-09-26", "activo", HOY, SIN_MORA);
    expect(r.diasVencido).toBe(3);
    expect(r.mora).toBe(0);
  });

  it("aplica % diario + recargo fijo después de la gracia", () => {
    // 10 días de atraso - 3 de gracia = 7 días con mora sobre 110
    // 110 * 2% * 7 = 15.40 + 5 de recargo = 20.40
    const r = calcularPrestamo(100, 10, 0, "2026-09-19", "activo", HOY, {
      tasaMora: 2,
      recargo: 5,
      diasGracia: 3,
    });
    expect(r.diasVencido).toBe(10);
    expect(r.mora).toBe(20.4);
    expect(r.totalAdeudado).toBe(130.4);
  });

  it("el recargo se cobra una sola vez, no por día", () => {
    const r = calcularPrestamo(100, 10, 0, "2026-08-29", "activo", HOY, {
      tasaMora: 0,
      recargo: 4,
      diasGracia: 3,
    });
    expect(r.mora).toBe(4);
  });

  it("no genera mora en préstamos no vencidos", () => {
    const r = calcularPrestamo(100, 10, 0, "2026-12-31", "activo", HOY, {
      tasaMora: 5,
      recargo: 10,
      diasGracia: 0,
    });
    expect(r.estadoCalc).toBe("activo");
    expect(r.mora).toBe(0);
  });
});

describe("fechas", () => {
  it("diasEntre cuenta días completos", () => {
    expect(diasEntre("2026-09-01", HOY)).toBe(28);
    expect(diasEntre(HOY, HOY)).toBe(0);
  });

  it("sumarDias salta meses y años", () => {
    expect(sumarDias("2026-01-31", 1)).toBe("2026-02-01");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("WhatsApp", () => {
  it("reemplaza las variables de la plantilla", () => {
    const texto = mensajeWhatsApp(
      "Hola {nombre}, pagas {monto} el {vencimiento}. {negocio}",
      { nombre: "Ana", monto: "BS 110", vencimiento: "2026-10-29", negocio: "Préstamo Fácil" }
    );
    expect(texto).toBe("Hola Ana, pagas BS 110 el 2026-10-29. Préstamo Fácil");
  });

  it("usa la plantilla por defecto si viene vacía", () => {
    expect(mensajeWhatsApp("", { nombre: "Luis" })).toContain("Hola Luis");
  });

  it("antepone el prefijo del país solo si el número es local", () => {
    expect(telefonoWhatsApp("04141234567", "58")).toBe("584141234567");
    expect(telefonoWhatsApp("+57 300 123 4567", "58")).toBe("573001234567");
    expect(telefonoWhatsApp("", "58")).toBe("");
  });

  it("arma el enlace de wa.me con el mensaje codificado", () => {
    const link = linkWhatsApp("04141234567", "Hola Ana", "58");
    expect(link.startsWith("https://wa.me/584141234567?text=")).toBe(true);
    expect(decodeURIComponent(link.split("?text=")[1])).toBe("Hola Ana");
  });
});

describe("seguridad y monedas", () => {
  it("el hash de contraseña verifica solo con la clave correcta", () => {
    const h = hashPassword("clave123");
    expect(verifyPassword("clave123", h)).toBe(true);
    expect(verifyPassword("otra", h)).toBe(false);
    expect(verifyPassword("clave123", "")).toBe(false);
  });

  it("genera hashes distintos para la misma clave", () => {
    expect(hashPassword("clave123")).not.toBe(hashPassword("clave123"));
  });

  it("valida la moneda y cae en BS si no existe", () => {
    expect(monedaValida("usd")).toBe("USD");
    expect(monedaValida("COP")).toBe("COP");
    expect(monedaValida("XXX")).toBe("BS");
    expect(monedaValida(undefined)).toBe("BS");
  });
});
