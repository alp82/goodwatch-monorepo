"""urllib transport for sitemap reads that accepts HTTP informational responses."""
import http.client
import urllib.request


class FinalResponse(http.client.HTTPResponse):
    def _read_status(self):
        # HTTPResponse.begin() only skips 100 in some Python versions. Consume other
        # informational headers on the same stream before it processes the final response.
        # 101 switches protocols and must remain visible to the caller.
        for _ in range(100):
            version, status, reason = super()._read_status()
            if not 100 <= status < 200 or status == 101:
                return version, status, reason
            http.client.parse_headers(self.fp)
        raise http.client.HTTPException("too many informational responses")


class HTTPConnection(http.client.HTTPConnection):
    response_class = FinalResponse


class HTTPSConnection(http.client.HTTPSConnection):
    response_class = FinalResponse


class HTTPHandler(urllib.request.HTTPHandler):
    def http_open(self, request):
        return self.do_open(HTTPConnection, request)


class HTTPSHandler(urllib.request.HTTPSHandler):
    def https_open(self, request):
        return self.do_open(HTTPSConnection, request, context=self._context)


def build_opener(*handlers):
    """Keep urllib's redirect/error/proxy handling, with final-response parsing."""
    return urllib.request.build_opener(HTTPHandler, HTTPSHandler, *handlers)
