# -*- coding: UTF-8 -*-

# Script para romper claves criptográficas RSA débiles, conocida la clave
# pública y capturado un criptograma. El objetivo es recuperar la clave privada
# y el mensaje sin cifrar. Utiliza un fichero con los primeros 10^6 números primos

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

# Usaremos los valores del problema propuesto en clase
e = int(input("Introduzca un número primo e: "))
N = int(input("Introduzca el número N (< 239811952854769): "))
C=int(input("Introduce el criptgrama: "))
# Sabemos que N=p*q, si asumimos p<q => p < sqrt(N) < q
# Para encontrar p y q, buscamos números primos menores que sqrt(N) 
# tal que sean divisores de N. Cargaremos la lista de los 10.000 primeros 
# numeros primos en una list y a partir de ahí, trabajamos

import csv
import re
primes = []
with open('primes1.txt', 'rU') as mymatrix:
        reader = csv.reader(mymatrix)
        a=1
        for row in reader:
                print "Cargando linea " + str(a)
		a = a+1
		if row == []:
                        continue
                primes = primes + re.split(r' +',row[0])

# Encontramos la clave privada por fuerza bruta
for p in primes:
	if p == '':
		continue
	print "Probando p= " + p
	p=int(p)
	r=N%p
	if r==0:
		break
print "p = " + str(p)

q=N/p
print "q = " + str(q)

d = modinv(e,(p-1)*(q-1))
print "Clave privada d = " + str(d)

M=pow(C,d,N)
print "El mensaje original es: " + str(M) 
