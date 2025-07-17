# Flush existing rules to start fresh
iptables -F
iptables -X

# Set default policies to DROP for INPUT, OUTPUT, and FORWARD chains
iptables -P INPUT ACCEPT
iptables -P OUTPUT ACCEPT
iptables -P FORWARD ACCEPT

