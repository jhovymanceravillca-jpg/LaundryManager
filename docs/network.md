# Red privada y seguridad

En VirtualBox configura Adaptador 1 como NAT para actualizaciones y acceso controlado desde Windows; configura Adaptador 2 como red interna `laundry-internal`. Esta topología no requiere instalar el controlador Host-only en Windows. Identifica los nombres de interfaz en cada VM con `ip -br link`; los nombres del archivo Netplan son ejemplos. La red interna no debe tener un gateway.

Direcciones: web `10.77.0.10/24`, API `10.77.0.20/24`, MySQL `10.77.0.30/24`. Desde Windows, abre el sitio en `http://127.0.0.1:8080`; NAT reenvía ese puerto al 80 de VM1. SSH se reenvía desde `127.0.0.1:2221`, `:2222` y `:2223` a VM1, VM2 y VM3 respectivamente. VM2 también puede exponer temporalmente su API en el puerto local 3001 para diagnóstico. No publiques estos puertos en una interfaz distinta de loopback.

Comprueba rutas y conectividad:

```bash
ip -br address
ip route
ping -c 4 10.77.0.20
ping -c 4 10.77.0.30
```

En la red NAT de VirtualBox, el gateway invitado para conexiones reenviadas es normalmente `10.0.2.2`; confirma el origen con `sudo journalctl` o los registros de UFW antes de fijar `ADMIN_CIDR` y `USER_CIDR`. Los scripts requieren que se definan explícitamente. VM2 acepta 3000 desde VM1, y VM3 acepta 3306 sólo desde VM2. No habilites acceso remoto de root en MySQL.

Para uso público, añade dominio y TLS válido en Nginx antes de habilitar HTTPS. No se incluye un dominio ficticio ni certificados inventados.
