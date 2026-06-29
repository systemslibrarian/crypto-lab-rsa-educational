# -*- coding: UTF-8 -*-

# Script para romper claves criptográficas RSA débiles, conocida la clave
# pública y capturado un criptograma. El objetivo es recuperar la clave privada
# y el mensaje sin cifrar. Utiliza un fichero con los primeros 10^4 números primos

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

# Introducimos los datos capturados
e = int(input("Introduzca un número primo e, de la clave pública: "))
N = int(input("Introduzca el número N, de la clave pública (menor que 10968163441): "))
C=int(input("Introduzca el criptograma: "))
# Sabemos que N=p*q, si asumimos p<q => p < sqrt(N) < q
# Para encontrar p y q, buscamos números primos menores que sqrt(N) 
# tal que sean divisores de N. Cargaremos la lista de los 10.000 primeros 
# numeros primos en una list y a partir de ahí, trabajamos

import csv
import re
primes = []
with open('10000.txt', 'rb') as mymatrix:
        reader = csv.reader(mymatrix)
        for row in reader:
                data = re.split(r' +',row[0])
                primes = primes + data

# La lista ya ha sido generada, ahora vamos probando por fuerza bruta
for p in primes:
	if p == '':
		continue	# Algunos elementos de la lista están en blanco, debido al parseo
	p=int(p)
	r=N%p
	if r==0:
		break		# Hemos dado con p!
print "p = " + str(p)

q=N/p
print "q = " + str(q)
# Con p y q ya podemos generar la clave privada
d = modinv(e,(p-1)*(q-1))
print "Clave privada d = " + str(d)
# Desciframos el mensaje
M=pow(C,d,N)
print "El mensaje original es: " + str(M) 

# Hemos roto una RSA débil
