# Red privada y seguridad

En VirtualBox configura Adaptador 1 como NAT para descargas y acceso administrativo, y Adaptador 2 como **Red solo-anfitrión (Host-only)** `192.168.56.0/24` para la comunicación entre las tres VMs y desde Windows. Identifica los nombres de interfaz en cada VM con `ip -br link`; los nombres usados en los ejemplos de Netplan (`enp0s3`, `enp0s8`) son orientativos. La interfaz Host-only **no debe tener gateway predeterminado**: la ruta por defecto permanece en NAT.

Direcciones (configurables): web `192.168.56.10/24`, API `192.168.56.20/24`, MySQL `192.168.56.30/24`. Desde Windows abre `http://192.168.56.10` (o `http://127.0.0.1:8080` si mantienes el reenvío NAT al puerto 80 de VM1). SSH se puede reenviar desde `127.0.0.1:2221`, `:2222` y `:2223` a VM1, VM2 y VM3. No publiques estos puertos en interfaces distintas de loopback.

Comprueba rutas y conectividad:

```bash
ip -br address
ip route
ping -c 4 192.168.56.20
ping -c 4 192.168.56.30
```

La red NAT de VirtualBox suele usar `10.0.2.2` como gateway invitado; confírmalo con `ip route` y con los registros de UFW antes de fijar `ADMIN_CIDR` y `USER_CIDR`. Los scripts requieren esas variables explícitas. VM2 acepta `3000` sólo desde VM1; VM3 acepta `3306` sólo desde VM2. No habilites acceso remoto de `root` en MySQL.

Si usas un Adaptador puente en lugar de Host-only, las VMs obtienen IP de tu red física: ajusta las direcciones, Netplan y firewalls, y documenta el cambio. Para uso público, añade dominio y TLS válido en Nginx antes de habilitar HTTPS. No se incluye un dominio ficticio ni certificados inventados.
