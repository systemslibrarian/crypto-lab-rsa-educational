# -*- coding: UTF-8 -*-
# Algoritmo para generar claves RSA, Genera un par de claves,
# y cifra un numero entero con la clave pública, para después
# decodificarlo con la privada

#Funciones para calcuar la inversa modular
def extended_gcd(aa, bb):
    lastremainder, remainder = abs(aa), abs(bb)
    x, lastx, y, lasty = 0, 1, 1, 0
    while remainder:
        lastremainder, (quotient, remainder) = remainder, divmod(lastremainder, remainder)
        x, lastx = lastx - quotient*x, x
        y, lasty = lasty - quotient*y, y
    return lastremainder, lastx * (-1 if aa < 0 else 1), lasty * (-1 if bb < 0 else 1)

def modinv(a, m):
	g, x, y = extended_gcd(a, m)
	if g != 1:
		raise ValueError
	return x % m

#PASO 1: Elegir 2 números primos p y q, supuestamente grandes y aleatorios (NO)
p = int(input("Introduce el número primo p: "))
q = int(input("Introduce el número primo q: "))
#PASO 2: Generar N
N=p*q
#Paso 3: Función de Euler sobre N
phi = (p-1)*(q-1)
#Paso 4: Escogemos e comprimo con phi(N) [mcd(e, phi(N))=1], el script se asegura de que sea coprimo
e = 0 
from fractions import gcd
while gcd(e,phi) != 1:
	e = int(input("Introduce el número primo e: "))
#Paso 5: Generar clave pública
pubkey = [N, e]
print "Tu clave pública (N,e) es " + str(pubkey)
#Paso 6: Generar d
d = modinv(e,phi)	# e^-1 mod Phi(N)
privkey=[d, N]
print "Tu clave privada (d,N) es" + str(privkey)
# Paso 7: Codificar mensaje
M = input("Introduce tu mensaje (Un número entero): ")
C = pow(M,e,N)	# M^e mod N
print "Criptograma: " + str(C)
#Pso 8: Decodificar mensaje
M = pow(C,d,N)	# C^d mod N 
print "Mensaje decodificado: " + str(M)

