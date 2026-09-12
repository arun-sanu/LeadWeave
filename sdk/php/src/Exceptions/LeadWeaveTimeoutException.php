<?php

declare(strict_types=1);

namespace LeadWeave\Exceptions;

/** Raised when a request exceeds the configured timeout. */
class LeadWeaveTimeoutException extends LeadWeaveException
{
    private float $timeout;

    public function __construct(float $timeout)
    {
        parent::__construct("Request timed out after {$timeout}s");
        $this->timeout = $timeout;
    }

    public function getTimeout(): float
    {
        return $this->timeout;
    }
}
