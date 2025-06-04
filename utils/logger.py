import logging
import os
from logging.handlers import RotatingFileHandler
from datetime import datetime

def setup_logger(name: str = None, level: str = "INFO", log_file: str = None) -> logging.Logger:
    """Set up a logger with both console and file handlers
    
    Args:
        name: Logger name (defaults to root logger)
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Optional log file path
        
    Returns:
        Configured logger instance
    """
    
    logger = logging.getLogger(name)
    
    # Don't add handlers if they already exist
    if logger.handlers:
        return logger
    
    # Set logging level
    log_level = getattr(logging, level.upper(), logging.INFO)
    logger.setLevel(log_level)
    
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler (if specified)
    if log_file:
        # Create logs directory if it doesn't exist
        log_dir = os.path.dirname(log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir)
        
        # Rotating file handler (10MB files, keep 5 backups)
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        file_handler.setLevel(log_level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger

def get_application_logger() -> logging.Logger:
    """Get the main application logger"""
    return setup_logger(
        name='contract_indexer',
        level=os.environ.get('LOG_LEVEL', 'INFO'),
        log_file=os.environ.get('LOG_FILE', 'logs/application.log')
    )

def log_api_request(logger: logging.Logger, method: str, url: str, status_code: int = None, response_time: float = None):
    """Log API request details"""
    message = f"API Request: {method} {url}"
    if status_code:
        message += f" - Status: {status_code}"
    if response_time:
        message += f" - Time: {response_time:.3f}s"
    
    if status_code and status_code >= 400:
        logger.warning(message)
    else:
        logger.info(message)

def log_error_with_context(logger: logging.Logger, error: Exception, context: dict = None):
    """Log error with additional context"""
    message = f"Error: {str(error)}"
    
    if context:
        context_str = ", ".join([f"{k}={v}" for k, v in context.items()])
        message += f" | Context: {context_str}"
    
    logger.error(message, exc_info=True)

def log_performance_metric(logger: logging.Logger, operation: str, duration: float, details: dict = None):
    """Log performance metrics"""
    message = f"Performance: {operation} took {duration:.3f}s"
    
    if details:
        details_str = ", ".join([f"{k}={v}" for k, v in details.items()])
        message += f" | Details: {details_str}"
    
    logger.info(message)

class ContextualLogger:
    """Logger that maintains context across related operations"""
    
    def __init__(self, logger: logging.Logger, context: dict = None):
        self.logger = logger
        self.context = context or {}
    
    def add_context(self, **kwargs):
        """Add context to the logger"""
        self.context.update(kwargs)
    
    def clear_context(self):
        """Clear the current context"""
        self.context = {}
    
    def _format_message(self, message: str) -> str:
        """Format message with context"""
        if self.context:
            context_str = ", ".join([f"{k}={v}" for k, v in self.context.items()])
            return f"{message} | Context: {context_str}"
        return message
    
    def debug(self, message: str):
        self.logger.debug(self._format_message(message))
    
    def info(self, message: str):
        self.logger.info(self._format_message(message))
    
    def warning(self, message: str):
        self.logger.warning(self._format_message(message))
    
    def error(self, message: str, exc_info: bool = False):
        self.logger.error(self._format_message(message), exc_info=exc_info)
    
    def critical(self, message: str):
        self.logger.critical(self._format_message(message))

def create_request_logger(request_id: str) -> ContextualLogger:
    """Create a logger for a specific request"""
    logger = get_application_logger()
    return ContextualLogger(logger, {'request_id': request_id})
