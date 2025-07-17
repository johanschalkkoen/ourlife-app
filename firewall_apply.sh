# Flush existing rules to start fresh
iptables -F
iptables -X

# Set default policies to DROP for INPUT, OUTPUT, and FORWARD chains
iptables -P INPUT DROP
iptables -P OUTPUT DROP
iptables -P FORWARD DROP

# Allow loopback traffic (localhost)
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Allow DNS (port 53, UDP and TCP) for inbound and outbound
iptables -A INPUT -p udp --sport 53 -j ACCEPT
iptables -A INPUT -p tcp --sport 53 -j ACCEPT
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT

# Allow inbound HTTP (port 80, TCP)
iptables -A INPUT -p tcp --dport 80 -j ACCEPT

# Allow inbound SSH (port 22, TCP)
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow inbound 4000 
iptables -A INPUT -p tcp --dport 4000 -j ACCEPT

# Allow established and related connections for outbound (needed for responses)
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Save the rules (example for systems using iptables-persistent or similar)
# For Debian/Ubuntu: sudo iptables-save > /etc/iptables/rules.v4
# For CentOS/RHEL: sudo iptables-save > /etc/sysconfig/iptables
