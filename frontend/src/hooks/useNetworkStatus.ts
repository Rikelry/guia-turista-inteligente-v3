import { useEffect, useState } from "react";

interface NetworkInformationLike extends EventTarget {
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformationLike;
}

export interface NetworkStatus {
  isOnline: boolean;
  effectiveType: string;
  rttMs: number;
  qualidadeLabel: "Excelente" | "Boa" | "Moderada" | "Lenta" | "Offline";
}

function lerStatusConexao(): NetworkStatus {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!isOnline) {
    return {
      isOnline: false,
      effectiveType: "OFFLINE",
      rttMs: 0,
      qualidadeLabel: "Offline",
    };
  }

  const nav = typeof navigator !== "undefined" ? (navigator as NavigatorWithConnection) : null;
  const conn = nav?.connection;
  const effectiveType = (conn?.effectiveType ?? "4g").toUpperCase();
  const rttMs = typeof conn?.rtt === "number" && conn.rtt > 0 ? conn.rtt : 50;

  let qualidadeLabel: NetworkStatus["qualidadeLabel"] = "Excelente";
  if (rttMs > 300 || effectiveType === "2G" || effectiveType === "SLOW-2G") {
    qualidadeLabel = "Lenta";
  } else if (rttMs > 150 || effectiveType === "3G") {
    qualidadeLabel = "Moderada";
  } else if (rttMs > 80) {
    qualidadeLabel = "Boa";
  }

  return {
    isOnline,
    effectiveType,
    rttMs,
    qualidadeLabel,
  };
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(lerStatusConexao);

  useEffect(() => {
    const atualizar = (): void => {
      setStatus(lerStatusConexao());
    };

    window.addEventListener("online", atualizar);
    window.addEventListener("offline", atualizar);

    const nav = navigator as NavigatorWithConnection;
    nav.connection?.addEventListener?.("change", atualizar);

    return () => {
      window.removeEventListener("online", atualizar);
      window.removeEventListener("offline", atualizar);
      nav.connection?.removeEventListener?.("change", atualizar);
    };
  }, []);

  return status;
}
