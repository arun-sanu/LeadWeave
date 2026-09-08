<?php

declare(strict_types=1);

namespace LeadWeave\Exceptions;

/** 429 Too Many Requests — rate limited. */
class LeadWeaveRateLimitException extends LeadWeaveApiException
{
}
