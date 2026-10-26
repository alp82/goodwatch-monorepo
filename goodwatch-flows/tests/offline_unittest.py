"""Run unittest with all non-loopback DNS and connections forbidden.

Example: python tests/offline_unittest.py discover -s tests -p test_page_scheduling.py
Disposable localhost databases remain available; all HTTP transport must be mocked.
"""
import ipaddress
import socket
import unittest
from unittest.mock import patch

_original_resolve = socket.getaddrinfo
_original_connect = socket.socket.connect
_original_connect_ex = socket.socket.connect_ex


def _loopback(host):
    if host == 'localhost':
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def _resolve(host, *args, **kwargs):
    if not _loopback(host):
        raise AssertionError(f'Offline test refused DNS: {host}')
    return _original_resolve(host, *args, **kwargs)


def _connect(sock, address):
    if sock.family in (socket.AF_INET, socket.AF_INET6) and not _loopback(address[0]):
        raise AssertionError(f'Offline test refused connection: {address[0]}')
    return _original_connect(sock, address)


def _connect_ex(sock, address):
    if sock.family in (socket.AF_INET, socket.AF_INET6) and not _loopback(address[0]):
        raise AssertionError(f'Offline test refused connection: {address[0]}')
    return _original_connect_ex(sock, address)


if __name__ == '__main__':
    with patch.object(socket, 'getaddrinfo', _resolve), patch.object(socket.socket, 'connect', _connect), patch.object(socket.socket, 'connect_ex', _connect_ex):
        unittest.main(module=None)
